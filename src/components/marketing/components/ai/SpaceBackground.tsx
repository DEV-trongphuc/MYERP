import * as React from 'react';
import { useMemo } from 'react';

const SpaceBackground = React.memo(({ theme = 'deep-space', opacity = 1 }: { theme?: string, opacity?: number }) => {
    // Generate static stars once
    const starsSm = useMemo(() => Array.from({ length: 150 }, () => `${Math.random() * 100}vw ${Math.random() * 100}vh #FFF`).join(','), []);
    const starsMd = useMemo(() => Array.from({ length: 30 }, () => `${Math.random() * 100}vw ${Math.random() * 100}vh rgba(255,255,255,0.4)`).join(','), []);

    const themeColors = useMemo(() => {
        switch (theme) {
            case 'nebula': return { from: '#020617', via: '#1e1b4b', to: '#4c1d95', accent1: 'bg-purple-900/20', accent2: 'bg-pink-900/10' };
            case 'cyberpunk': return { from: '#0f172a', via: '#000000', to: '#1e1b4b', accent1: 'bg-cyan-900/20', accent2: 'bg-blue-900/10' };
            case 'ocean': return { from: '#000000', via: '#0c4a6e', to: '#082f49', accent1: 'bg-emerald-900/10', accent2: 'bg-sky-900/20' };
            case 'pure-black': return { from: '#000000', via: '#000000', to: '#050505', accent1: 'bg-white/5', accent2: 'bg-slate-900/10' };
            default: return { from: '#0f1115', via: '#000000', to: '#000000', accent1: 'bg-blue-900/10', accent2: 'bg-purple-900/10' };
        }
    }, [theme]);

    return (
        <div
            className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none bg-[#000000]"
            style={{ opacity }}
        >
            {/* Deep Space Gradient */}
            <div className="absolute inset-0 transition-colors duration-1000" style={{ background: `radial-gradient(circle at center, ${themeColors.from}, ${themeColors.via}, ${themeColors.to})` }} />

            {/* Galaxy Gradient Overlay */}
            <div className={`absolute inset-0 transition-colors duration-1000 mix-blend-screen opacity-30 ${themeColors.accent1} via-transparent ${themeColors.accent2}`} />

            {/* Background Stars (Visible Rotation - 200s) */}
            <div className="absolute inset-0 animate-[spin_200s_linear_infinite] opacity-60">
                <div className="stars-sm" style={{ boxShadow: starsSm, width: '1px', height: '1px', background: 'transparent' }} />
                <div className="stars-md" style={{ boxShadow: starsMd, width: '2px', height: '2px', background: 'transparent', position: 'absolute', top: 0, left: 0 }} />
            </div>

            {/* Dynamic Twinkling Stars (Small 1-2px, Moving, Bright) */}
            {/* Star 1 */}
            <div className="absolute top-[20%] left-[15%] w-[2px] h-[2px] bg-white rounded-full shadow-[0_0_6px_1px_rgba(255,255,255,0.8)] animate-twinkle-move" style={{ animationDelay: '0s', '--tx': '40px', '--ty': '-20px' } as React.CSSProperties} />

            {/* Star 2 */}
            <div className="absolute top-[60%] right-[25%] w-[1.5px] h-[1.5px] bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.9)] animate-twinkle-move" style={{ animationDelay: '1.5s', '--tx': '-50px', '--ty': '30px' } as React.CSSProperties} />

            {/* Star 3 */}
            <div className="absolute bottom-[30%] left-[40%] w-[2px] h-[2px] bg-cyan-100 rounded-full shadow-[0_0_6px_1px_rgba(200,255,255,0.8)] animate-twinkle-move" style={{ animationDelay: '0.5s', '--tx': '30px', '--ty': '40px' } as React.CSSProperties} />

            {/* Star 4 */}
            <div className="absolute top-[30%] right-[10%] w-[2px] h-[2px] bg-purple-100 rounded-full shadow-[0_0_8px_2px_rgba(230,220,255,0.8)] animate-twinkle-move" style={{ animationDelay: '2.0s', '--tx': '-30px', '--ty': '-30px' } as React.CSSProperties} />

            {/* Star 5 (New) */}
            <div className="absolute bottom-[20%] right-[40%] w-[1px] h-[1px] bg-white rounded-full shadow-[0_0_6px_2px_rgba(255,255,255,1)] animate-twinkle-move" style={{ animationDelay: '1.0s', '--tx': '20px', '--ty': '-40px' } as React.CSSProperties} />


            {/* Subtle Nebulas (Slower Pulse) */}
            <div className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-brand bg-opacity-[0.03] rounded-full blur-[150px] animate-pulse-slow" />
            <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] bg-brand bg-opacity-[0.03] rounded-full blur-[120px] animate-pulse-slow delay-1000" />

            <style>{`
                @keyframes twinkle-move {
                    0% { opacity: 0; transform: scale(0.5) translate(0, 0); }
                    20% { opacity: 1; transform: scale(1) translate(calc(var(--tx) * 0.2), calc(var(--ty) * 0.2)); box-shadow: 0 0 10px 2px rgba(255, 255, 255, 0.8); }
                    80% { opacity: 1; transform: scale(1) translate(calc(var(--tx) * 0.8), calc(var(--ty) * 0.8)); box-shadow: 0 0 10px 2px rgba(255, 255, 255, 0.8); }
                    100% { opacity: 0; transform: scale(0.5) translate(var(--tx), var(--ty)); }
                }
                .animate-twinkle-move {
                    animation: twinkle-move 5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
});

export default SpaceBackground;
