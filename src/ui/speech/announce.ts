import { armOnFirstGesture, speakSystemLine } from './systemSpeech';
import { playClip, stopClip } from './voicePackAudio';

/**
 * Saying one line, outside React's lifecycle.
 *
 * This used to live inside the effect in useSystemVoice, and that was a
 * bug with a very specific shape. The effect claimed the line, awaited
 * playback, and only armed the first-gesture fallback if playback had
 * failed *and* the effect had not been cleaned up:
 *
 *     const spoke = await say();
 *     if (spoke || cancelled) return;      // <- cancelled by StrictMode
 *     disarm = armOnFirstGesture(...);     // <- therefore never reached
 *
 * React StrictMode mounts, unmounts and remounts every component in
 * development. The unmount set `cancelled` before the await resolved, and
 * the remount saw the line already claimed and returned early — so on any
 * browser that blocks autoplay (which is every browser, on a page that
 * has not been touched yet) the fallback was never armed and the line
 * could never be heard, however many times the Player tapped.
 *
 * The fix is not a StrictMode workaround. It is to stop making arming
 * conditional on a race: **arm first, then try**, and disarm only once
 * sound has actually happened. Nothing here reads React state or depends
 * on a component still being mounted, so there is no lifecycle left to
 * lose the line to.
 */

/** Fingerprints that have actually produced sound this session. */
const said = new Set<string>();
/** Disposer for the pending first-gesture listener, if one is armed. */
let disarm: (() => void) | null = null;

/**
 * How many mounted screens are currently showing the System's line.
 *
 * A count rather than a boolean because React StrictMode mounts,
 * unmounts and remounts, and a tab change can briefly overlap the two —
 * a boolean would be left `false` by the outgoing screen's cleanup after
 * the incoming one had already set it `true`.
 */
let onStage = 0;

/**
 * Marks the System's line as being on screen for as long as the caller
 * is mounted. Returns the release, which is idempotent so a double
 * cleanup cannot drive the count negative.
 */
export function enterStage(): () => void {
  onStage += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    onStage -= 1;
  };
}

/**
 * How long to wait after the unlocking gesture before deciding whether
 * the line is still wanted.
 *
 * Long enough for a tab tap to have become a navigation and for the
 * outgoing screen to have unmounted. Waiting costs nothing: a user
 * gesture gives the document *sticky activation*, so audio stays
 * unlocked long after the event that unlocked it — there is no narrow
 * window to play inside.
 */
const SETTLE_MS = 250;

/** How many user gestures may retry a line before giving up on it. A
 * failure that survives three real taps is an environment problem — no
 * audio route, a muted tab, a locked-down engine — and retrying on every
 * touch for the rest of the session would not fix it. */
const MAX_GESTURE_RETRIES = 3;

export function resetSpokenMemory(): void {
  said.clear();
  disarm?.();
  disarm = null;
}

/** True once the line has been heard — used by tests and diagnostics. */
export function hasSaid(fingerprint: string): boolean {
  return said.has(fingerprint);
}

interface AnnounceArgs {
  fingerprint: string;
  /** Id of the rendered clip; null falls straight to device speech. */
  messageId: string | null;
  text: string;
  /** Checked again at gesture time, so turning the voice off mid-wait
   * does not produce a delayed announcement. */
  stillEnabled: () => boolean;
}

/**
 * Says a line once, now if the browser allows it and at the Player's
 * first touch if it does not.
 *
 * Idempotent per fingerprint: calling it twice for the same state — which
 * StrictMode guarantees, and a re-render makes likely — arms one listener
 * and plays one line.
 */
export function announce({ fingerprint, messageId, text, stillEnabled }: AnnounceArgs): void {
  if (said.has(fingerprint)) return;
  said.add(fingerprint);

  const attempt = async (): Promise<boolean> => {
    if (!stillEnabled()) return false;
    if (messageId && (await playClip(messageId))) return true;
    return speakSystemLine(text);
  };

  const release = () => {
    disarm?.();
    disarm = null;
  };

  let retries = 0;
  const armRetry = () => {
    release();
    disarm = armOnFirstGesture(() => {
      disarm = null;
      // The gesture that unlocks audio is, more often than not, the one
      // that *leaves* this screen — the first thing a Player touches on
      // a freshly opened app is usually a tab. `pointerdown` fires
      // before the router has navigated and before the outgoing screen
      // has unmounted, so deciding here would always decide "still on
      // Today" and the line would play over PROGRESS. Let the
      // navigation settle, then look at where we actually ended up.
      window.setTimeout(() => {
        if (!stillEnabled()) return;

        if (onStage === 0) {
          // The gesture took the Player somewhere else. Put the line
          // back rather than saying it to the wrong screen: the next
          // visit re-announces it, and because activation is sticky by
          // then, that attempt plays outright and needs no fallback at
          // all.
          said.delete(fingerprint);
          return;
        }

        void attempt().then((spoke) => {
          if (!spoke && (retries += 1) < MAX_GESTURE_RETRIES) armRetry();
        });
      }, SETTLE_MS);
    });
  };

  // Armed *before* the first attempt, not after it. A browser that is
  // going to refuse has already refused by the time the promise settles,
  // and a Player who taps during that window would otherwise tap into a
  // listener that did not exist yet.
  armRetry();

  void attempt().then((spoke) => {
    if (spoke) release();
  });
}

/** Stops whatever is currently speaking, in either engine. */
export function silence(): void {
  stopClip();
  disarm?.();
  disarm = null;
}
