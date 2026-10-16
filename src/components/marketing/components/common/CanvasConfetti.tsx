import React, { useEffect, useRef } from 'react';

interface Particle {
    x: number;
    y: number;
    r: number;
    dx: number;
    dy: number;
    color: string;
    tilt: number;
    tiltAngle: number;
    tiltAngleInc: number;
}

interface CanvasConfettiProps {
    duration?: number; // In ms, 0 means infinite
    colors?: string[];
    particleCount?: number;
}

const defaultColors = [
    '#f59e0b', '#ea580c', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f43f5e'
];

export const CanvasConfetti: React.FC<CanvasConfettiProps> = ({
    duration = 3000,
    colors = defaultColors,
    particleCount = 100
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animationFrameId = useRef<number | null>(null);
    const startTime = useRef<number>(Date.now());

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = window.innerWidth;
        const H = window.innerHeight;
        canvas.width = W;
        canvas.height = H;

        // Initialize particles
        particlesRef.current = [];
        for (let i = 0; i < particleCount; i++) {
            particlesRef.current.push({
                x: Math.random() * W, // Start across the top or from center
                y: Math.random() * H - H, // Start above screen
                r: Math.random() * 6 + 2, // Radius
                dx: Math.random() * 4 - 2, // X velocity
                dy: Math.random() * 3 + 2, // Y velocity
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.floor(Math.random() * 10) - 10,
                tiltAngle: 0,
                tiltAngleInc: (Math.random() * 0.07) + 0.05
            });
        }

        startTime.current = Date.now();

        const render = () => {
            if (!ctx || !canvas) return;
            ctx.clearRect(0, 0, W, H);

            const elapsed = Date.now() - startTime.current;
            if (duration > 0 && elapsed > duration) {
                // Let them fall out but don't respawn
            }

            let activeParticles = 0;

            particlesRef.current.forEach((p) => {
                p.tiltAngle += p.tiltAngleInc;
                p.y += p.dy;
                p.x += Math.sin(p.tiltAngle) * 2 + p.dx;
                p.dy += 0.05; // Gravity

                if (p.y <= H) activeParticles++;

                ctx.beginPath();
                ctx.lineWidth = p.r;
                ctx.strokeStyle = p.color;
                ctx.moveTo(p.x + p.tilt + p.r, p.y);
                ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
                ctx.stroke();
            });

            if (activeParticles > 0) {
                animationFrameId.current = requestAnimationFrame(render);
            }
        };

        render();

        const handleResize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, [duration, colors, particleCount]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[9999]"
            aria-hidden="true"
        />
    );
};

export default CanvasConfetti;
