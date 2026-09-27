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
export const playChatNotificationSound = () => {
  if (!isChatSoundEnabled()) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
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
