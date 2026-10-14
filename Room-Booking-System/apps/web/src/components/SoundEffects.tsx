import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { playSound, setSoundEnabled, soundEnabled, unlockSound } from '../lib/sound-effects';
import './sound-effects.css';

export function SoundEffects() {
  const [enabled, setEnabled] = useState(soundEnabled);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const target = event.target.closest('button, a[href], [role="button"]');
      if (!target || target.matches(':disabled, [aria-disabled="true"], [data-sound-toggle]')) return;
      unlockSound(); playSound('click');
    };
    // Only announce a newly visible message; background DOM changes stay silent.
    const seen = new WeakMap<Element, string>();
    const messages = () => {
      document.querySelectorAll('[role="alert"], .reference-toast, .toast').forEach(element => {
        const message = element.textContent?.trim() ?? '';
        if (!message || seen.get(element) === message || !element.getClientRects().length) return;
        seen.set(element, message);
        playSound(element.getAttribute('role') === 'alert' ? 'error' : 'notification');
      });
    };
    const observer = new MutationObserver(messages);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    document.addEventListener('click', click, true);
    return () => { observer.disconnect(); document.removeEventListener('click', click, true); };
  }, []);
  return <button type="button" data-sound-toggle className="sound-toggle" aria-label="เสียงเอฟเฟกต์" aria-pressed={enabled} title={enabled ? 'ปิดเสียงเอฟเฟกต์' : 'เปิดเสียงเอฟเฟกต์'} onClick={() => {
    const value = !enabled; setSoundEnabled(value); setEnabled(value);
    if (value) { unlockSound(); playSound('click'); }
  }}>{enabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}<span>เสียง{enabled ? 'เปิด' : 'ปิด'}</span></button>;
}
