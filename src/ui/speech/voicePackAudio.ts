/**
 * The System's rendered voice.
 *
 * Every line in engine/voicePack.ts is pre-rendered to `/voice/<id>.mp3`
 * by scripts/generate-voice-pack.mjs and served from the app's own
 * origin, which is what makes this work at all:
 *
 *  - `api.fish.audio` sends no CORS headers and its preflight 404s, so
 *    the browser could never have called it directly.
 *  - The 156 lines are fixed. There is nothing to synthesise per Player,
 *    per day or per state, so rendering them once beats rendering them
 *    forever.
 *  - No API key reaches the client. A key in a bundle is a key anyone can
 *    spend.
 *  - Static files are precached by the service worker, so the System
 *    speaks with the network off — the constraint the whole feature is
 *    built around (design/04 §18).
 *
 * When a clip is missing — a line added since the last render, a failed
 * request during generation, a build with no pack at all — this reports
 * failure and the caller falls back to the device's own speech engine.
 * The System is never silent because of a missing file.
 */

export interface VoiceManifest {
  voiceId: string;
  model: string;
  bitrate: number;
  ids: string[];
}

const MANIFEST_URL = '/voice/manifest.json';

let manifestPromise: Promise<Set<string> | null> | null = null;

/**
 * Which lines have audio, fetched once per session.
 *
 * Asking the manifest rather than probing for the file means a missing
 * clip costs nothing: no 404 in the console on every open, and no wait
 * on a request that was always going to fail before falling back.
 */
export function loadManifest(): Promise<Set<string> | null> {
  if (manifestPromise) return manifestPromise;

  manifestPromise = fetch(MANIFEST_URL)
    .then((r) => (r.ok ? (r.json() as Promise<VoiceManifest>) : null))
    .then((m) => (m && Array.isArray(m.ids) ? new Set(m.ids) : null))
    .catch(() => null);

  return manifestPromise;
}

/** Test seam — the manifest is cached for the life of the page. */
export function resetManifestCache(): void {
  manifestPromise = null;
}

export function clipUrl(messageId: string): string {
  return `/voice/${encodeURIComponent(messageId)}.mp3`;
}

let current: HTMLAudioElement | null = null;

export function stopClip(): void {
  if (!current) return;
  try {
    current.pause();
    current.src = '';
  } catch {
    /* already gone */
  }
  current = null;
}

/**
 * Plays one line's clip.
 *
 * Resolves true once playback has actually begun — not when the file has
 * loaded. On a phone `play()` rejects with NotAllowedError until the page
 * has seen a user gesture, and that rejection is precisely the signal the
 * caller needs in order to arm its retry rather than assume silence was
 * intended.
 */
export async function playClip(messageId: string): Promise<boolean> {
  const available = await loadManifest();
  if (available && !available.has(messageId)) return false;

  stopClip();

  try {
    const audio = new Audio(clipUrl(messageId));
    audio.preload = 'auto';
    current = audio;

    await audio.play();
    return true;
  } catch {
    // NotAllowedError (no gesture yet), NotSupportedError (no such file),
    // or a decode failure. All three mean: let the device voice speak.
    if (current) stopClip();
    return false;
  }
}

/**
 * Warms the browser cache for a clip without playing it.
 *
 * Used on the settings screen so the preview is instant, and harmless
 * everywhere else — a failed prefetch is simply a prefetch that did not
 * happen.
 */
export function prefetchClip(messageId: string): void {
  void fetch(clipUrl(messageId)).catch(() => {});
}
