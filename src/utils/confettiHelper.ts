import confetti from 'canvas-confetti';

/**
 * Generates a clean, ascending 4-note success chime (arpeggio) using the browser's native Web Audio API.
 * Requires no external mp3 assets, ensuring 100% reliable execution.
 */
export const playSuccessSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Ascending arpeggio notes: C4, E4, G4, C5
    const notes = [261.63, 329.63, 392.00, 523.25];
    const duration = 0.4;
    
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Use triangle wave for a warm, clean chiptune arpeggio
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
  } catch (err) {
    console.error('Audio play error:', err);
  }
};

/**
 * Triggers a multi-burst 3D confetti animation shooting from the center, left, and right corners.
 * Plays the success chime sound synchronously.
 */
export const triggerFullConfetti = () => {
  // Play chime sound
  playSuccessSound();

  // Burst 1: Center
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 }
  });

  // Burst 2: Left corner shooting diagonally up-right
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.8 }
    });
  }, 200);

  // Burst 3: Right corner shooting diagonally up-left
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.8 }
    });
  }, 400);
};

/**
 * Triggers an exquisite, subtle localized burst of micro-confetti right at the element or mouse position.
 */
export const triggerLocalConfetti = (clientX?: number, clientY?: number) => {
  playSuccessSound();

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
