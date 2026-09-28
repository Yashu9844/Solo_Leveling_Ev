import { useEffect, useRef } from 'react';
import { useSettings } from '../../store/SettingsContext';
import { announce, enterStage, silence } from './announce';

export { resetSpokenMemory } from './announce';

interface UseSystemVoiceArgs {
  /** The id of the line, which is also the name of its rendered clip. */
  messageId: string | null;
  /** The same line as text, for the device-speech fallback. */
  text: string | null;
  /** The state it was chosen for. Null disables speech entirely. */
  fingerprint: string | null;
}

/**
 * Says the current System line once per app open.
 *
 * Deliberately thin. All of the hard parts — the two engines, the
 * first-gesture fallback, and saying a line exactly once — live in
 * announce.ts, outside React, because tying them to an effect's lifetime
 * is what broke this the first time: StrictMode's extra unmount cancelled
 * the fallback before it was armed, and the line became unreachable on
 * any browser that blocks autoplay. A hook that only forwards arguments
 * has no race to lose.
 *
 * A page reload is a new app open and the System greets you again; a
 * re-render, a tab round trip or a quest toggle inside the same state is
 * not, and stays silent — the fingerprint is already the identity of a
 * state (engine/systemVoice.ts), so that falls out rather than needing a
 * second rule.
 */
export function useSystemVoice({ messageId, text, fingerprint }: UseSystemVoiceArgs): void {
  const { settings } = useSettings();
  const enabled = settings.voice;

  // Read through a ref so the gesture fallback, which may fire minutes
  // later, checks the setting as it is *then* rather than as it was when
  // the line was chosen.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Says "the System's line is on screen" for as long as this screen is
  // mounted. The deferred half of announce() reads it to decide whether
  // the gesture that just unlocked audio was the Player settling in or
  // the Player leaving — without it, the very first tap on the PROGRESS
  // tab plays Today's line over Progress.
  useEffect(() => enterStage(), []);

  useEffect(() => {
    if (!enabled || !text || !fingerprint) return;
    announce({ fingerprint, messageId, text, stillEnabled: () => enabledRef.current });
  }, [enabled, text, messageId, fingerprint]);

  // Turning the voice off should stop the System mid-sentence rather than
  // take effect after it finishes talking.
  useEffect(() => {
    if (!enabled) silence();
  }, [enabled]);

  // Note what is deliberately absent: a cancel on unmount. Today unmounts
  // on every tab change, and these lines run three or four seconds, so
  // cutting one off mid-word to move to Skills reads as a glitch rather
  // than as tidiness. Overlap is impossible anyway — both engines stop
  // whatever is playing before they start.
}
