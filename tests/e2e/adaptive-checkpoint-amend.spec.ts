// platform/05 loop 14.3: the checkpoint's Amend step. Seal the Day 30 checkpoint of a generated System, amend it structurally, and the new
// version begins on Day 31; Day 30 and everything before it is as it was.
import { expect, test } from '@playwright/test';
import { generateBlueprint } from '../../src/generator';
import { p1 } from '../fixtures/personas/p1';
import { personaEventLog } from '../engine/support/personaEventLog';
import { seedGeneratedSystem } from './support/seedDatabase';

test.use({ reducedMotion: 'reduce' });

test.describe('the checkpoint\'s Amend step', () => {
  test('a structural amendment made after the Day 30 seal begins on Day 31', async ({ page }) => {
    test.setTimeout(120_000);
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
    page.on('console', (message) => { if (message.type() === 'error') problems.push('console: ' + message.text()); });

    const { blueprint } = generateBlueprint(p1.draft);
    expect(blueprint.progression.checkpointDays.slice(0, 2)).toEqual([14, 30]);
    const events = personaEventLog(blueprint, p1.seed, { kind: 'steady', days: 29 });
    const now = '2026-09-30T10:00:00Z'; // Day 30
    const sealedDay14 = {
      id: 'cp-14', day: 14, sealed_at: '2026-09-14T10:00:00Z', export_verified: true, metrics: {}, self_efficacy: {}, automaticity: {}, enjoyment: {},
      rank_before: 'E', rank_after: 'E', gates: {}, controlled: {}, external: {}, quest_templates_snapshot: {}, blueprint_version: 1,
    };
    await page.clock.install({ time: new Date(now) });
    await seedGeneratedSystem(page, blueprint, events, now, { checkpoint: [sealedDay14] });

    await page.goto('/profile');
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
    await page.getByRole('button', { name: /Next checkpoint: Day 30/ }).click();
    const sheet = page.getByTestId('checkpoint-screen');
    await expect(sheet).toBeVisible();
    // Before the seal there is nothing to amend.
    await expect(sheet.getByTestId('amend-step')).toHaveCount(0);

    await sheet.getByRole('button', { name: 'Export' }).click();
    await sheet.getByRole('button', { name: 'Seal checkpoint' }).click();
    await expect(sheet.getByText(/Sealed\. Rank/)).toBeVisible();

    // The step appears; a shift of weight is structural and, today, begins tomorrow.
    const step = sheet.getByTestId('amend-step');
    await expect(step).toBeVisible();
    await step.getByRole('button', { name: 'Move 10 XP' }).click();
    await expect(step.getByTestId('amend-class')).toHaveText('STRUCTURAL');
    await expect(step.getByTestId('amend-effect')).toHaveText('TAKES EFFECT TOMORROW, THE DAY AFTER THE CHECKPOINT.');
    await step.getByTestId('amend-activate').click();
    await expect(step.getByTestId('amend-done')).toBeVisible();

    // The timeline: version 2 is scheduled from Day 31 (2026-10-01); version 1 is still in force today.
    await page.goto('/profile/settings/system/blueprint');
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId('version-badge')).toHaveText('v1 · genesis');
    await expect(page.getByTestId('revision-2')).toContainText('v2 · since Day 31');
    await expect(page.getByTestId('revision-2')).toContainText('structural');
    await expect(page.getByTestId('revision-2')).toContainText('from 2026-10-01');
    expect(problems).toEqual([]);
  });
});
