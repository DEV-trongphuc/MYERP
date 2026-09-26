import confetti from 'canvas-confetti';

/**
 * Sound preferences state manager
 */
const SOUND_KEY = 'myerp_sound_enabled';

export const isSoundEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(SOUND_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
};

export const setSoundEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOUND_KEY, String(enabled));
  } catch {}
};

export const toggleSoundEnabled = (): boolean => {
  const current = isSoundEnabled();
  setSoundEnabled(!current);
  return !current;
};

/**
 * Helper to get or create Web Audio Context safely
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    return new AudioContextClass();
  } catch {
    return null;
  }
}

/**
 * 1. Pop Sound - Short, organic, satisfying wooden bubble pop
 * Ideal for: Quick button clicks, copy actions, status toggles, tag selects
 */
export const playPopSound = () => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.09);
  } catch {}
};

/**
 * 2. Ding Sound - Crystal clear, warm dual-tone bell chime (C6 + E6 harmonic)
 * Ideal for: Chấm công thành công (Clock-in/out), Duyệt phiếu phê duyệt (Approvals), Lưu dữ liệu thành công
 */
export const playDingSound = () => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Harmonic bell frequencies (High C6: 1046.5Hz and E6: 1318.5Hz)
    const tones = [1046.5, 1318.51, 2093.0];
    const duration = 0.65;

    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx === 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const peakGain = idx === 0 ? 0.22 : idx === 1 ? 0.16 : 0.06;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.05);
    });
  } catch {}
};

/**
 * 3. Success Arpeggio Sound
 */
export const playSuccessSound = () => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [261.63, 329.63, 392.00, 523.25];
    const duration = 0.4;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime + index * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + index * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.08 + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + index * 0.08);
      osc.stop(ctx.currentTime + index * 0.08 + duration + 0.05);
    });
  } catch {}
};

/**
 * 4. Deal Won & Sales Order (SO) Victory Fanfare
 * Triumphant multi-chord fanfare + gold confetti
 */
export const playDealWonFanfare = () => {
  if (isSoundEnabled()) {
    try {
      const ctx = getAudioContext();
      if (ctx) {
        // Triumphant 6-note arpeggio chord: C4, E4, G4, C5, E5, G5
        const fanfareNotes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
        const duration = 0.7;

        fanfareNotes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = idx >= 3 ? 'triangle' : 'sine';
          const startTime = ctx.currentTime + idx * 0.07;

          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + duration + 0.05);
        });
      }
    } catch {}
  }

  // Grand Triple Confetti Burst with Gold, Emerald, Crimson and Sapphire colors
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#F59E0B', '#10B981', '#E11D48', '#3B82F6', '#8B5CF6', '#FBBF24']
  });

  setTimeout(() => {
    confetti({
      particleCount: 75,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.75 },
      colors: ['#F59E0B', '#10B981', '#FBBF24', '#FFFFFF']
    });
  }, 180);

  setTimeout(() => {
    confetti({
      particleCount: 75,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.75 },
      colors: ['#E11D48', '#3B82F6', '#FBBF24', '#FFFFFF']
    });
  }, 360);
};

/**
 * 5. Full 3-Way Confetti Burst with Sound
 */
export const triggerFullConfetti = () => {
  playDealWonFanfare();
};

/**
 * 6. Subtle localized micro-confetti
 */
export const triggerLocalConfetti = (clientX?: number, clientY?: number) => {
  playDingSound();

  const x = (typeof window !== 'undefined' && clientX !== undefined && clientX > 0)
    ? Math.min(Math.max(clientX / window.innerWidth, 0.05), 0.95)
    : 0.5;
  const y = (typeof window !== 'undefined' && clientY !== undefined && clientY > 0)
    ? Math.min(Math.max(clientY / window.innerHeight, 0.05), 0.95)
    : 0.5;

  confetti({
    particleCount: 40,
    spread: 60,
    startVelocity: 22,
    ticks: 100,
    gravity: 1.1,
    origin: { x, y },
    colors: ['#10B981', '#34D399', '#3B82F6', '#F59E0B', '#BD1D2D'],
    scalar: 0.8,
    disableForReducedMotion: true
  });
};

