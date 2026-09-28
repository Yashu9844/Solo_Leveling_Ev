import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

/**
 * The System, out loud.
 *
 * Two engines, and the spec covers both: the pre-rendered character voice
 * under /voice, and the device's own speech engine behind it.
 *
 * Two things shape how this is written.
 *
 * `page.route` cannot intercept an `<audio>` element's request — media
 * loads come from the media stack rather than the fetch stack, so a route
 * handler on `*.mp3` never fires and a spec built on one silently proves
 * nothing. Requests are therefore *observed* through `page.on('request')`,
 * and only the manifest — an ordinary fetch — is ever stubbed.
 *
 * The rendered pack is a local artifact (`npm run voice`), gitignored and
 * absent on a fresh clone. The tests that need real clips skip themselves
 * with a message saying so rather than failing for the wrong reason; the
 * fallback tests stub an empty manifest and run everywhere.
 */
const AFTERNOON = '2026-09-05T10:00:00Z';

interface SpokenLine {
  text: string;
  rate: number;
  pitch: number;
  voice: string | null;
}

declare global {
  interface Window {
    __spoken: SpokenLine[];
  }
}

async function stubSpeech(page: Page) {
  await page.addInitScript(() => {
    window.__spoken = [];

    class FakeUtterance {
      text: string;
      rate = 1;
      pitch = 1;
      volume = 1;
      lang = '';
      voice: { name: string; lang: string } | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    const voices = [
      { name: 'Microsoft Zira - English (United States)', lang: 'en-US', localService: true },
      { name: 'Microsoft Ravi - English (India)', lang: 'en-IN', localService: true },
      { name: 'Google हिन्दी', lang: 'hi-IN', localService: true },
    ];

    const synth = {
      speaking: false,
      getVoices: () => voices,
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      speak: (u: FakeUtterance) => {
        window.__spoken.push({
          text: u.text,
          rate: u.rate,
          pitch: u.pitch,
          voice: u.voice ? u.voice.name : null,
        });
        u.onstart?.();
        setTimeout(() => u.onend?.(), 0);
      },
    };

    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: FakeUtterance,
      configurable: true,
    });
  });
}

/** Records every clip the app actually asks the media stack for. */
function watchClips(page: Page): string[] {
  const played: string[] = [];
  page.on('request', (request) => {
    const match = /\/voice\/([^/?]+)\.mp3$/.exec(request.url());
    if (match) played.push(decodeURIComponent(match[1]));
  });
  return played;
}

/** Declares the pack empty — a clone that has never run `npm run voice`. */
async function serveEmptyPack(page: Page) {
  await page.route('**/voice/manifest.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ voiceId: 'test', model: 's2.1-pro-free', bitrate: 64, ids: [] }),
    })
  );
}

/** How many clips this checkout actually has rendered. */
async function packSize(page: Page): Promise<number> {
  const response = await page.request.get('/voice/manifest.json');
  if (!response.ok()) return 0;
  const body = (await response.json()) as { ids?: string[] };
  return body.ids?.length ?? 0;
}

const spoken = (page: Page) => page.evaluate(() => window.__spoken);

test('the System plays its rendered line when the app opens', async ({ page }) => {
  test.skip((await packSize(page)) === 0, 'no rendered voice pack — run `npm run voice`');

  const played = watchClips(page);
  await stubSpeech(page);
  await page.clock.install({ time: new Date(AFTERNOON) });
  await completeOnboarding(page);

  await expect(page.getByTestId('system-transmission')).toBeVisible();
  await expect.poll(() => played.length).toBeGreaterThan(0);

  // The clip that plays is the line that is on screen — one library, one
  // id, so the System's mouth and its words cannot drift apart.
  expect(played[0]).toMatch(/^[a-z0-9-]+$/);

  // The character voice carries it; the device engine stays out of the way.
  expect(await spoken(page)).toHaveLength(0);
});

test('a line with no rendered clip falls back to the device voice', async ({ page }) => {
  const played = watchClips(page);
  await stubSpeech(page);
  await serveEmptyPack(page);
  await page.clock.install({ time: new Date(AFTERNOON) });
  await completeOnboarding(page);

  await expect(page.getByTestId('system-transmission')).toBeVisible();

  const onScreen = (
    await page.getByTestId('system-transmission').locator('p[role="status"]').textContent()
  )?.trim();

  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(0);
  const lines = await spoken(page);

  // Same words, lesser voice — never silence.
  expect(lines[0].text).toBe(onScreen);
  expect(lines[0].rate).toBeLessThan(1);
  expect(lines[0].pitch).toBeLessThan(1);
  expect(lines[0].voice).toContain('Ravi');

  // And it did not waste a request on a clip the manifest says is absent.
  expect(played).toHaveLength(0);
});

test('it says the line once, not on every render or tab round trip', async ({ page }) => {
  test.skip((await packSize(page)) === 0, 'no rendered voice pack — run `npm run voice`');

  const played = watchClips(page);
  await stubSpeech(page);
  await page.clock.install({ time: new Date(AFTERNOON) });
  await completeOnboarding(page);

  await expect.poll(() => played.length).toBe(1);

  await page.getByRole('link', { name: 'SKILLS' }).click();
  await expect(page.getByRole('heading', { name: 'SKILLS' })).toBeVisible();
  await page.getByRole('link', { name: 'TODAY' }).click();
  await expect(page.getByTestId('system-transmission')).toBeVisible();

  // Same state, same line already heard — the System does not repeat itself.
  await page.waitForTimeout(500);
  expect(played).toHaveLength(1);
});

test('turning the voice off makes it silent', async ({ page }) => {
  const played = watchClips(page);
  await stubSpeech(page);
  await page.clock.install({ time: new Date(AFTERNOON) });
  await completeOnboarding(page);
  await expect(page.getByTestId('system-transmission')).toBeVisible();

  await page.getByRole('link', { name: 'PROFILE' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByTestId('settings-appearance-row').click();
  await expect(page.getByTestId('appearance-screen')).toBeVisible();

  await page.getByTestId('voice-toggle-row').getByRole('button', { name: 'Off' }).click();

  played.length = 0;
  await page.evaluate(() => {
    window.__spoken = [];
  });

  // A fresh open, which is the trigger — and it must stay quiet, in both
  // engines.
  await page.reload();
  await expect(page.getByTestId('appearance-screen')).toBeVisible();
  await page.getByRole('link', { name: 'TODAY' }).click();
  await expect(page.getByTestId('system-transmission')).toBeVisible();
  await page.waitForTimeout(600);

  expect(played).toHaveLength(0);
  expect(await spoken(page)).toHaveLength(0);
});

/**
 * Refuses autoplay the way a real browser does on a page nobody has
 * touched yet: `play()` rejects with NotAllowedError, and speechSynthesis
 * accepts the call but never fires `start`.
 */
async function blockAutoplay(page: Page) {
  await page.addInitScript(() => {
    const realPlay = HTMLMediaElement.prototype.play;
    let unlocked = false;
    window.addEventListener('pointerdown', () => { unlocked = true; }, { capture: true });
    window.addEventListener('keydown', () => { unlocked = true; }, { capture: true });

    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      if (unlocked) return realPlay.call(this);
      return Promise.reject(
        Object.assign(new Error('play() failed because the user didn’t interact first'), {
          name: 'NotAllowedError',
        })
      );
    };
  });
}

test('a blocked first attempt is armed, not lost: the line plays on the first tap', async ({
  page,
}) => {
  test.skip((await packSize(page)) === 0, 'no rendered voice pack — run `npm run voice`');

  const played = watchClips(page);
  await blockAutoplay(page);
  // No speech engine either, so the clip is the only way this line can be
  // heard and the test cannot pass through the fallback by accident.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
  });
  await page.clock.install({ time: new Date(AFTERNOON) });
  await completeOnboarding(page);
  await expect(page.getByTestId('system-transmission')).toBeVisible();

  // Reload so the document has no user activation at all — this is what
  // opening an already-onboarded app actually looks like, and the case
  // every earlier test in this file missed by arriving via onboarding.
  played.length = 0;
  await page.reload();
  await expect(page.getByTestId('system-transmission')).toBeVisible();
  await page.waitForTimeout(1200);

  // The clip was requested but refused playback, so nothing was heard.
  const beforeTap = played.length;

  // One touch anywhere, and the System says the line it was holding.
  // Before the fix this tap did nothing at all: StrictMode's extra
  // unmount cancelled the arming before it happened, so the line was
  // unreachable for the rest of the session.
  await page.mouse.click(200, 400);
  await expect.poll(() => played.length, { timeout: 8000 }).toBeGreaterThan(beforeTap);
});
