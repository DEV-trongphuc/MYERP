import React from 'react';
import { EmailBlock } from '../../../../types';
import { AlertTriangle } from 'lucide-react';
import { API_BASE_URL, EXTERNAL_API_BASE } from '../../../../utils/config';

interface CountdownTimerProps {
    block: EmailBlock;
    boxStyle: React.CSSProperties; // boxStyle contains font size/color for the digits
    labelStyle: React.CSSProperties;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ block, boxStyle, labelStyle }) => {
    // Extract styles to construct the image URL parameters
    // Note: boxStyle usually has fontSize and color from the parent's generic logic
    const digitColor = (block.style.color || '#ffffff').replace('#', '');
    const labelColor = (block.style.labelColor || '#004a7c').replace('#', '');
    // In editor, backgroundColor might be separate, but let's pass it if needed. 
    // Usually timer background is transparent or handled by the container.
    const bg = 'transparent';
    const targetDateStr = block.style.targetDate || '';

    // Use server-side generated image to match actual email output
    // useMemo ensures URL updates when block changes, forcing cache refresh
    const timerUrl = React.useMemo(() => {
        // Use block.id + timestamp for stronger cache busting
        const cacheBuster = `${block.id}_${Date.now()}`;
        return `${EXTERNAL_API_BASE}/timer.php?target=${encodeURIComponent(targetDateStr)}&color=${digitColor}&bg=${bg}&v=${cacheBuster}`;
    }, [targetDateStr, digitColor, bg, block.id]);

    return (
        <div style={{ textAlign: 'center', background: 'transparent' }}>
            {!block.style.targetDate && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-red-500 mb-2 font-bold animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" /> Hãy chọn ngày kết thúc
                </div>
            )}
            {/* Timer Container */}
            <div style={{ display: 'inline-block', maxWidth: '100%' }}>
                {/* Numbers Image */}
                <img
                    src={timerUrl}
                    alt="Countdown Timer"
                    width="500"
                    style={{ display: 'block', maxWidth: '100%', height: 'auto', margin: '0 auto' }}
                />
                {/* Labels in HTML */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    marginTop: '4px',
                    fontSize: '13px',
                    fontWeight: '800',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: labelColor ? `#${labelColor}` : '#004a7c'
                }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>NGÀY</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>GIỜ</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>PHÚT</div>
                </div>
            </div>
        </div>
    );
};

export default CountdownTimer;
