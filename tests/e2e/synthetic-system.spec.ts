// platform/05 loop 7.9: a Blueprint that is not the owner's renders on every screen.
//
// The synthetic System (support/syntheticSystem.ts) renames every domain, quest, group, tree and
// reality row and gives them hues and glyphs the owner's System never uses. The screens must show
// those names and tokens - nothing of the owner's wording may leak through - and must not throw.
// Reading only: the flag is irrelevant, since the projections are seeded the way a rebuild writes them.
import { expect, test, type Page } from '@playwright/test';
import { seedDatabase } from './support/seedDatabase';
import { SYNTHETIC_DOMAINS, syntheticLog } from './support/syntheticSystem';

const NOW = '2026-10-10T08:30:00Z';

async function settle(page: Page): Promise<void> {
  await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

test.describe('a second, synthetic Blueprint', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 800 } });

  test('every screen shows its own names and tokens and raises no error', async ({ page }) => {
    test.setTimeout(180_000);
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    await page.clock.install({ time: new Date(NOW) });
    await seedDatabase(page, syntheticLog(), NOW);

    await test.step('Today: designations, hues and the log button come from the Blueprint', async () => {
      await page.goto('/today');
      await settle(page);
      for (const [domain, skin] of Object.entries(SYNTHETIC_DOMAINS)) {
        if (['foundations', 'maintenance'].includes(domain)) continue;
        const row = page.getByTestId(`quest-row-${domain}`);
        await expect(row).toContainText(skin.designation);
        await expect(row).toContainText(`${skin.name.toLowerCase()} for the day`);
        await expect(row.locator(`[style*="--hue-${skin.hue}-border"]`)).toHaveCount(1);
      }
      // None of the owner's wording survives.
      for (const owner of ['ASCENSION', 'LOGIC TRIAL', 'FORGE', 'VITALITY TRIAL', 'RECONSTITUTION', 'WILL TRIAL']) {
        await expect(page.getByText(owner, { exact: true })).toHaveCount(0);
      }
      await expect(page.getByRole('button', { name: /Log Lore/ })).toBeVisible(); // the support-domain action card

      await page.getByTestId('quest-row-dsa-open').click();
      await expect(page.getByText("Do today's puzzles.")).toBeVisible();
      await page.getByRole('button', { name: 'Log Riddle' }).click();
      await expect(page.getByRole('dialog').getByText('Log Riddle').first()).toBeVisible();
      await page.keyboard.press('Escape');
    });

    await test.step('Progress: the Blueprint\'s groups and reality rows', async () => {
      await page.goto('/progress');
      await settle(page);
      await expect(page.getByTestId('reality-tab')).toContainText('Riddles solved');
      await expect(page.getByTestId('reality-tab')).toContainText('Lore mastered');
      await page.getByRole('button', { name: 'SYSTEM' }).click();
      const bars = page.getByTestId('attribute-bars');
      for (const heading of ['HEAD', 'HANDS', 'HEART']) await expect(bars).toContainText(heading);
      await expect(bars).not.toContainText('MIND');
    });

    await test.step('Attributes: the generic group screen', async () => {
      await page.goto('/attributes/mind');
      await settle(page);
      await expect(page.getByTestId('attribute-group')).toContainText('HEAD');
      await expect(page.getByTestId('attribute-group')).toContainText('DISCIPLINE');
    });

    await test.step('Skills: trees, milestones and the self-cert card by their Blueprint names', async () => {
      await page.goto('/skills');
      await settle(page);
      for (const tab of ['RIDDLE', 'LORE', 'FRONTIER', 'MILESTONES', 'INTERVIEW-READINESS BENCHMARK']) {
        await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
      }
      await page.getByRole('button', { name: 'MILESTONES', exact: true }).click();
      await expect(page.getByText('Milestones', { exact: true }).first()).toBeVisible();
      await page.getByRole('button', { name: 'INTERVIEW-READINESS BENCHMARK', exact: true }).click();
      await expect(page.getByRole('button', { name: 'PASSED', exact: true })).toBeVisible();
    });

    await test.step('Profile and the reminder settings', async () => {
      await page.goto('/profile');
      await settle(page);
      await expect(page.getByText(/Next checkpoint: Day/)).toBeVisible();
      await page.goto('/profile/settings/system');
      await settle(page);
      for (const label of ['Outreach', 'Puzzles', 'Motion']) await expect(page.getByTestId('system-screen')).toContainText(label);
      await expect(page.getByTestId('system-screen')).not.toContainText('DSA');
    });

    expect(problems).toEqual([]);
  });
});
