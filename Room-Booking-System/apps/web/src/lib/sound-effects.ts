export type SoundEffect = 'click' | 'success' | 'error' | 'notification';
const storageKey = 'kku-sound-enabled';
let enabled = true;
try { enabled = localStorage.getItem(storageKey) !== '0'; } catch { /* Keep the preference in memory when storage is unavailable. */ }
let context: AudioContext | undefined;
let lastFeedback = 0;

export function soundEnabled() { return enabled; }
export function setSoundEnabled(value: boolean) {
  enabled = value;
  try { localStorage.setItem(storageKey, value ? '1' : '0'); } catch { /* Sound controls still work without storage. */ }
}
export function unlockSound() {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch { /* Unsupported audio must never interrupt an action. */ }
}
export function playSound(effect: SoundEffect) {
  if (!enabled || !context || context.state !== 'running') return;
  const now = performance.now();
  if (effect !== 'click' && now - lastFeedback < 250) return;
  if (effect !== 'click') lastFeedback = now;
  const notes: Record<SoundEffect, number[]> = {
    click: [660], success: [523.25, 659.25, 783.99], error: [330, 246.94], notification: [587.33, 783.99],
  };
  try {
    const start = context.currentTime;
    notes[effect].forEach((frequency, index) => {
      const oscillator = context!.createOscillator(), gain = context!.createGain();
      const time = start + index * .09, duration = effect === 'click' ? .035 : .13;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(effect === 'click' ? .025 : .055, time + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
      oscillator.connect(gain); gain.connect(context!.destination);
      oscillator.start(time); oscillator.stop(time + duration + .01);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  } catch { /* Audio failure must not change the result of a user action. */ }
}
