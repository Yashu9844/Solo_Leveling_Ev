/**
 * The System, out loud.
 *
 * Built on the browser's own `speechSynthesis`, which is the only option
 * that keeps design/04's hard constraints intact: the voices are already
 * on the device, so this works with the network off, adds nothing to the
 * bundle, and never sends a line of the Player's state anywhere. A pack
 * of pre-rendered audio would have meant ~150 files and a download; a
 * cloud TTS call would have meant an online dependency for the app's
 * first paint. Neither is acceptable for an offline-first PWA.
 *
 * Two facts about the Web Speech API shape everything below:
 *
 *  1. `getVoices()` is empty on the first call in Chrome and fills in
 *     later, announced by `voiceschanged`. Any code that picks a voice
 *     synchronously on load gets the platform default forever.
 *  2. Mobile browsers refuse to speak until the document has seen a user
 *     gesture. A cold PWA launch has had none — so a line that is simply
 *     spoken on mount is silently dropped on exactly the platform this
 *     app is built for. `armOnFirstGesture` is the answer, not a retry.
 */

/** Scoring inputs, extracted so the choice is testable without a browser. */
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

/**
 * How the System sounds: slower than conversation, pitched down, and
 * never quite warm. Deliberately close to the lower bound of natural —
 * pushed further it stops reading as a system and starts reading as a
 * novelty filter.
 */
export const SYSTEM_VOICE_SETTINGS = { rate: 0.82, pitch: 0.65, volume: 1 } as const;

/**
 * Preference order for the voice itself.
 *
 * English only — the library is written in English and a Hindi or French
 * engine reading it produces something unintelligible rather than
 * accented. Beyond that the ranking prefers a masculine, local (offline)
 * voice, because the alternative on most devices is a bright synthetic
 * soprano that fights everything the writing is doing.
 */
const NAME_BONUS: { pattern: RegExp; score: number }[] = [
  { pattern: /\b(male|david|daniel|george|ravi|rishi|alex|fred|guy|aaron)\b/i, score: 40 },
  { pattern: /\b(google (uk|us) english)\b/i, score: 22 },
  { pattern: /\b(microsoft|natural|neural|enhanced|premium)\b/i, score: 14 },
  { pattern: /\b(female|zira|samantha|karen|moira|tessa|heera)\b/i, score: -25 },
  { pattern: /\b(whisper|novelty|bells|bubbles|cellos|organ|zarvox|trinoids)\b/i, score: -80 },
];

export function scoreVoice(voice: VoiceLike): number {
  const lang = (voice.lang || '').toLowerCase();
  if (!lang.startsWith('en')) return Number.NEGATIVE_INFINITY;

  let score = 0;
  // en-IN first: this is an arc run in Asia/Kolkata, and the accent the
  // Player hears every day is the one that sounds least like a costume.
  if (lang.startsWith('en-in')) score += 30;
  else if (lang.startsWith('en-gb')) score += 18;
  else if (lang.startsWith('en-us')) score += 12;

  if (voice.localService) score += 20; // offline-capable, and lower latency
  if (voice.default) score += 4;

  for (const { pattern, score: bonus } of NAME_BONUS) {
    if (pattern.test(voice.name)) score += bonus;
  }
  return score;
}

/** The best available System voice, or null to let the platform choose. */
export function pickSystemVoice<T extends VoiceLike>(voices: T[]): T | null {
  let best: T | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const voice of voices) {
    const score = scoreVoice(voice);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return bestScore === Number.NEGATIVE_INFINITY ? null : best;
}

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  const s = window.speechSynthesis;
  return s && typeof s.speak === 'function' ? s : null;
}

/** Whether this device can speak at all. */
export function speechAvailable(): boolean {
  return synth() !== null && typeof window.SpeechSynthesisUtterance === 'function';
}

/**
 * Chrome populates the voice list asynchronously. Resolve on
 * `voiceschanged`, but never wait forever — an empty list is a valid
 * outcome, and speaking in the platform default beats staying silent.
 */
function loadVoices(timeoutMs = 1200): Promise<SpeechSynthesisVoice[]> {
  const s = synth();
  if (!s) return Promise.resolve([]);

  const ready = s.getVoices();
  if (ready.length > 0) return Promise.resolve(ready);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      s.removeEventListener?.('voiceschanged', finish);
      clearTimeout(timer);
      resolve(s.getVoices());
    };
    const timer = setTimeout(finish, timeoutMs);
    s.addEventListener?.('voiceschanged', finish);
  });
}

/**
 * Says one line in the System's voice.
 *
 * Resolves true if the utterance actually started. That return value is
 * what the caller uses to decide whether to fall back to a gesture: a
 * browser that is blocking speech fires neither `start` nor `error`, it
 * simply never speaks, so "did it start" has to be observed rather than
 * assumed.
 */
export async function speakSystemLine(text: string, startTimeoutMs = 1500): Promise<boolean> {
  const s = synth();
  if (!s || !text.trim()) return false;

  try {
    // Anything queued is about a state that is no longer current.
    s.cancel();

    const voices = await loadVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickSystemVoice(voices);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = SYSTEM_VOICE_SETTINGS.rate;
    utterance.pitch = SYSTEM_VOICE_SETTINGS.pitch;
    utterance.volume = SYSTEM_VOICE_SETTINGS.volume;

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (started: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(started);
      };
      utterance.onstart = () => done(true);
      utterance.onerror = () => done(false);
      // Some engines fire `end` without `start` for very short lines.
      utterance.onend = () => done(true);
      // Deliberately NOT `s.speaking`. A browser holding an utterance
      // back for want of a user gesture reports `speaking === true` while
      // nothing is audible, which would suppress the gesture fallback in
      // exactly the case it exists for. Only `start` proves sound. The
      // cost of being wrong here is one cancel-and-restart at the next
      // tap (speak() cancels first), which is cheap; the cost of the
      // other mistake is permanent silence on a phone.
      const timer = setTimeout(() => done(false), startTimeoutMs);
      s.speak(utterance);
    });
  } catch {
    // A device with no audio route, a locked-down engine, a browser that
    // throws on construction — none of it is worth a broken screen.
    return false;
  }
}

export function stopSpeaking(): void {
  try {
    synth()?.cancel();
  } catch {
    /* nothing to stop */
  }
}

/**
 * Runs `action` at the first real interaction with the page.
 *
 * This is the whole reason the System still speaks on a cold PWA launch:
 * the browser will not allow audio until the Player touches something,
 * so the line waits — armed, not lost — until the first tap, click or
 * key press, and then says itself. Returns a disposer so a screen that
 * unmounts first does not leave a listener behind.
 */
export function armOnFirstGesture(action: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const events = ['pointerdown', 'touchstart', 'keydown'] as const;
  const fire = () => {
    dispose();
    action();
  };
  const dispose = () => {
    for (const type of events) window.removeEventListener(type, fire);
  };
  for (const type of events) {
    window.addEventListener(type, fire, { once: true, passive: true });
  }
  return dispose;
}
