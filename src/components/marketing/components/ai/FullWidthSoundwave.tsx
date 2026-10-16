import * as React from 'react';
import { useRef, useEffect } from 'react';

// Soundwave Component - Realtime Audio Version
const FullWidthSoundwave = React.memo(({ text, onStop }: { text: string, onStop: () => void }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Initialize Audio Visualizer
    useEffect(() => {
        const initAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream; // Store for cleanup

                const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
                const audioCtx = new AudioContext();
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;

                const source = audioCtx.createMediaStreamSource(stream);
                source.connect(analyser);

                audioContextRef.current = audioCtx;
                analyserRef.current = analyser;
                sourceRef.current = source;

                draw();
            } catch (err) {
                console.error("Error accessing microphone for visualizer:", err);
            }
        };

        const draw = () => {
            if (!canvasRef.current || !analyserRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const renderFrame = () => {
                rafIdRef.current = requestAnimationFrame(renderFrame);
                analyserRef.current!.getByteFrequencyData(dataArray);

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Draw tailored bars
                const barwidth = 4;
                const gap = 4;
                const totalBars = 40;

                const totalWidth = totalBars * (barwidth + gap);
                let startX = (canvas.width - totalWidth) / 2; // Center horizontally

                const step = Math.floor(bufferLength / totalBars);

                for (let i = 0; i < totalBars; i++) {
                    const dataIndex = i * step;
                    const value = dataArray[dataIndex];
                    const percent = value / 255;

                    // Dynamic height
                    const height = Math.max(4, percent * canvas.height * 0.8);

                    const x = startX + i * (barwidth + gap);
                    const y = (canvas.height - height) / 2; // Center vertically

                    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + percent * 0.7})`;

                    // Fallback to fillRect if roundRect not available
                    if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(x, y, barwidth, height, 4);
                        ctx.fill();
                    } else {
                        ctx.fillRect(x, y, barwidth, height);
                    }
                }
            };
            renderFrame();
        };

        initAudio();

        return () => {
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            if (sourceRef.current) sourceRef.current.disconnect();
            if (analyserRef.current) analyserRef.current.disconnect();
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
            if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
        };
    }, []);

    // Resize canvas
    useEffect(() => {
        const resize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = canvasRef.current.parentElement?.clientWidth || 300;
                canvasRef.current.height = canvasRef.current.parentElement?.clientHeight || 60;
            }
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    return (
        <div
            className="absolute inset-x-0 bottom-0 top-0 z-50 rounded-[24px] flex items-center justify-center bg-[#16181c] border border-white/20 cursor-pointer overflow-hidden p-0"
            onClick={onStop}
        >
            {/* Helper Text */}
            <div className="absolute top-3 left-0 right-0 text-center text-[10px] text-white/40 font-mono tracking-widest uppercase pointer-events-none z-20">
                Listening... Tap to stop
            </div>

            {/* Content Container - Centered */}
            <div className="flex flex-col items-center justify-center w-full h-full relative z-10">
                {/* Realtime Text */}
                <div className="absolute inset-x-0 px-4 flex justify-center text-center" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                    <span className="text-xl md:text-2xl font-medium text-white truncate drop-shadow-md z-30">
                        {text}
                    </span>
                </div>
            </div>

            {/* Visualizer - Centered & Behind */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-80">
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>
        </div>
    );
});

export default FullWidthSoundwave;
