const SOUND_STORAGE_KEY = 'myerp_chat_sound_enabled';

export const isChatSoundEnabled = (): boolean => {
  try {
    const val = localStorage.getItem(SOUND_STORAGE_KEY);
    return val !== 'false';
  } catch (e) {
    return true;
  }
};

export const setChatSoundEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (e) {}
};

/**
 * Web Audio API synthesized notification chime for WorkChat
 * Plays a clean, pleasant 2-tone melodic chime without downloading external files
 */
let sharedAudioCtx: AudioContext | null = null;
let lastSoundPlayedTime = 0;

/**
 * Returns or initializes a singleton AudioContext instance.
 */
const getOrCreateAudioContext = (): AudioContext | null => {
  try {
    if (!sharedAudioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      sharedAudioCtx = new AudioContextClass();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
};

/**
 * Automatically pre-unlock AudioContext on first user interaction (click, keypress, touch)
 * so sound chimes are never silenced by browser autoplay restrictions.
 */
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true, once: true });
  window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
}

export const playChatNotificationSound = () => {
  if (!isChatSoundEnabled()) return;
  const nowTime = Date.now();
  // Throttle chimes: avoid overlapping audio contexts when multiple messages arrive in burst
  if (nowTime - lastSoundPlayedTime < 1200) return;
  lastSoundPlayedTime = nowTime;

  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Harmonic bell chime: C6 (1046.5Hz) -> E6 (1318.5Hz) -> G6 (1567.9Hz)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now);
    osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1567.98, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(2093.0, now + 0.2);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.15);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.4);
  } catch (e) {
    // Autoplay or browser policy silence
  }
};
