import { describe, it, expect } from 'vitest';
import {
  SYSTEM_VOICE_SETTINGS,
  pickSystemVoice,
  scoreVoice,
  speechAvailable,
  type VoiceLike,
} from '../../src/ui/speech/systemSpeech';

const v = (name: string, lang: string, extra: Partial<VoiceLike> = {}): VoiceLike => ({
  name,
  lang,
  localService: true,
  ...extra,
});

describe('scoreVoice', () => {
  it('rejects every language the library is not written in', () => {
    // A Hindi or French engine reading English capitals does not produce
    // an accent, it produces noise.
    for (const voice of [v('Kalpana', 'hi-IN'), v('Thomas', 'fr-FR'), v('Yuna', 'ko-KR')]) {
      expect(scoreVoice(voice)).toBe(Number.NEGATIVE_INFINITY);
    }
  });

  it('prefers the accent the Player actually hears every day', () => {
    // The arc runs in Asia/Kolkata.
    expect(scoreVoice(v('Ravi', 'en-IN'))).toBeGreaterThan(scoreVoice(v('Ravi', 'en-US')));
    expect(scoreVoice(v('Alex', 'en-GB'))).toBeGreaterThan(scoreVoice(v('Alex', 'en-AU')));
  });

  it('prefers an offline voice to a cloud one', () => {
    expect(scoreVoice(v('David', 'en-US', { localService: true }))).toBeGreaterThan(
      scoreVoice(v('David', 'en-US', { localService: false }))
    );
  });

  it('pushes novelty voices to the bottom without excluding them', () => {
    const novelty = scoreVoice(v('Bubbles', 'en-US'));
    expect(novelty).toBeLessThan(scoreVoice(v('Daniel', 'en-US')));
    expect(novelty).toBeGreaterThan(Number.NEGATIVE_INFINITY);
  });
});

describe('pickSystemVoice', () => {
  it('returns null for an empty list, so the platform default is used', () => {
    expect(pickSystemVoice([])).toBeNull();
  });

  it('returns null when nothing on the device speaks English', () => {
    expect(pickSystemVoice([v('Kalpana', 'hi-IN'), v('Amelie', 'fr-CA')])).toBeNull();
  });

  it('picks the deep local English voice out of a realistic device list', () => {
    const chosen = pickSystemVoice([
      v('Microsoft Zira - English (United States)', 'en-US'),
      v('Google हिन्दी', 'hi-IN'),
      v('Microsoft Ravi - English (India)', 'en-IN'),
      v('Google UK English Female', 'en-GB', { localService: false }),
    ]);
    expect(chosen?.name).toContain('Ravi');
  });

  it('is deterministic — the same device list always yields the same voice', () => {
    const list = [v('Samantha', 'en-US'), v('Daniel', 'en-GB'), v('Alex', 'en-US')];
    const first = pickSystemVoice(list)?.name;
    for (let i = 0; i < 20; i += 1) {
      expect(pickSystemVoice(list)?.name).toBe(first);
    }
  });
});

describe('the System register', () => {
  it('is slower and lower than conversation, without becoming a novelty filter', () => {
    expect(SYSTEM_VOICE_SETTINGS.rate).toBeLessThan(1);
    expect(SYSTEM_VOICE_SETTINGS.rate).toBeGreaterThanOrEqual(0.7);
    expect(SYSTEM_VOICE_SETTINGS.pitch).toBeLessThan(1);
    expect(SYSTEM_VOICE_SETTINGS.pitch).toBeGreaterThanOrEqual(0.5);
  });
});

describe('speechAvailable', () => {
  it('reports false rather than throwing where there is no window at all', () => {
    // Node. The whole module has to survive being imported server-side,
    // or the app cannot be built.
    expect(speechAvailable()).toBe(false);
  });
});
