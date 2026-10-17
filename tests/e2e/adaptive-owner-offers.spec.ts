// platform/05 loop 14.5: the owner's opt-in offers, put at a sealed checkpoint's Amend step. The owner takes one and leaves the other;
// declining changes nothing. (The adaptive build has the V2 engine on; the owner's own System is seeded as the legacy log it is.)
import { expect, test } from '@playwright/test';
import { dateAt, legacyActivityLog } from '../engine/support/legacyActivityLog';
import { seedDatabase } from './support/seedDatabase';

test.use({ reducedMotion: 'reduce' });

test.describe('the owner\'s opt-in offers', () => {
  test('accepting one begins on Day 31, declining the other changes nothing', async ({ page }) => {
    test.setTimeout(150_000);
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
    page.on('console', (message) => { if (message.type() === 'error') problems.push('console: ' + message.text()); });

    const now = `${dateAt(29)}T10:00:00Z`; // Day 30
    const sealedDay14 = {
      id: 'cp-14', day: 14, sealed_at: `${dateAt(13)}T10:00:00Z`, export_verified: true, metrics: {}, self_efficacy: {}, automaticity: {}, enjoyment: {},
      rank_before: 'E', rank_after: 'E', gates: {}, controlled: {}, external: {}, quest_templates_snapshot: {},
    };
    await page.clock.install({ time: new Date(now) });
    await seedDatabase(page, legacyActivityLog({ seed: 42, days: 29 }), now, { settings: { wakeTime: '06:30' }, checkpoint: [sealedDay14] });

    await page.goto('/profile');
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
    await page.getByRole('button', { name: /Next checkpoint: Day 30/ }).click();
    const sheet = page.getByTestId('checkpoint-screen');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('owner-offers')).toHaveCount(0); // nothing to offer until it is sealed

    await sheet.getByRole('button', { name: 'Export' }).click();
    await sheet.getByRole('button', { name: 'Seal checkpoint' }).click();
    await expect(sheet.getByText(/Sealed\. Rank/)).toBeVisible();

    const offers = sheet.getByTestId('owner-offers');
    await expect(offers).toBeVisible();
    await expect(sheet.getByTestId('owner-offer-wake-target')).toContainText('Honour the wake time');
    await expect(sheet.getByTestId('owner-offer-reduced-mode-collapse')).toContainText('Reduced Mode');

    await sheet.getByTestId('owner-offer-reduced-mode-collapse-decline').click();
    await expect(sheet.getByTestId('owner-offer-reduced-mode-collapse-answer')).toHaveText('Declined. Nothing changed.');
    await sheet.getByTestId('owner-offer-wake-target-accept').click();
    await expect(sheet.getByTestId('owner-offer-wake-target-answer')).toHaveText('Accepted. It begins tomorrow.');

    // One new version, scheduled for Day 31; the System in force today is the one it has always been.
    await page.goto('/profile/settings/system/blueprint');
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId('version-badge')).toHaveText('v1 · genesis');
    await expect(page.getByTestId('revision-2')).toContainText('v2 · since Day 31');
    await expect(page.getByTestId('revision-2')).toContainText(`from ${dateAt(30)}`);
    await expect(page.getByTestId('revision-3')).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});
