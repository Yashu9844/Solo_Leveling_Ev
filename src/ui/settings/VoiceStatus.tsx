import { useEffect, useState } from 'react';
import { loadManifest } from '../speech/voicePackAudio';
import { speechAvailable } from '../speech/systemSpeech';

/**
 * What the voice is actually doing on *this* device.
 *
 * "I hear nothing" has four unrelated causes — no rendered pack, no
 * speech engine, audio still locked behind a first gesture, or the
 * setting simply off — and from inside the app they are indistinguishable
 * from each other and from a bug. This row names which one it is, so the
 * next step is obvious instead of a guess.
 *
 * Deliberately plain text, not a warning: none of these states is an
 * error. A locked audio context on a freshly loaded page is the browser
 * working exactly as designed.
 */
export function VoiceStatus() {
  const [clips, setClips] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadManifest().then((ids) => {
      if (alive) setClips(ids ? ids.size : 0);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // navigator.userActivation is the browser's own answer to "may I play
    // sound yet", and is far more honest than probing with a real
    // utterance — which would itself make a noise to answer the question.
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
      .userActivation;
    if (!activation) {
      setUnlocked(true); // Safari and friends: assume yes rather than cry wolf.
      return;
    }
    setUnlocked(activation.hasBeenActive);
    const tick = window.setInterval(() => setUnlocked(activation.hasBeenActive), 500);
    return () => window.clearInterval(tick);
  }, []);

  const parts: string[] = [];

  if (clips === null) parts.push('Checking voice pack…');
  else if (clips === 0) parts.push('No voice pack on this device — run `npm run voice`');
  else parts.push(`${clips} clips ready`);

  parts.push(speechAvailable() ? 'device voice available' : 'no device speech engine');
  parts.push(unlocked ? 'audio unlocked' : 'audio locked until you tap the screen');

  return (
    <p
      data-testid="voice-status"
      className="px-1 pt-1.5 font-mono text-[10px] leading-relaxed tracking-[0.06em] text-faint"
    >
      {parts.join(' · ')}
    </p>
  );
}
