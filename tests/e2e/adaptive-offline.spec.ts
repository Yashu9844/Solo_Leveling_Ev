// platform/05 loop 15.4: offline. A person who has opened the app once can go through the whole onboarding - the interview, the Reveal, the
// activation - with the network gone, and the app asks nobody but its own origin for anything, before or after.
import { expect, test } from '@playwright/test';
import { begin, choicesFor, interview } from './support/adaptive';

test.use({ reducedMotion: 'reduce' });

test.describe('offline', () => {
  test('the interview, the Reveal and the activation all work with the network off, and nothing leaves the origin', async ({ page, context, baseURL }) => {
    test.setTimeout(150_000);
    const origin = new URL(baseURL!).origin;
    const foreign: string[] = [];
    const failed: string[] = [];
    page.on('request', (request) => { if (!request.url().startsWith(origin) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) foreign.push(request.url()); });
    page.on('requestfailed', (request) => failed.push(request.url()));
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));

    // Warm up online: the service worker installs and takes the page, and its cache fills.
    await page.goto('/onboarding');
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await context.setOffline(true);
    failed.length = 0;
    await begin(page, 'quick');
    const { areas, resolution } = choicesFor('fitness');
    await interview(page, areas, resolution);
    await page.getByRole('button', { name: 'Initialise system' }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });

    // And it is still there after a reload with the network still off.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'TODAY' })).toBeVisible();

    expect(foreign, 'requests to another origin').toEqual([]);
    // Art plates and voice clips are deliberately cached on first view, not precached (vite.config.ts, design §2.6): offline, an unseen plate is
    // its procedural gradient and an unheard line is the device voice. Anything else failing offline would be a real hole.
    expect(failed.filter((url) => !/\.webp$|\/voice\//.test(url)), 'requests that failed offline').toEqual([]);
    expect(problems).toEqual([]);
    await context.setOffline(false);
  });
});
