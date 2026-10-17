// platform/05 loop 14.2: staged drafts. The change class and the start are computed and shown before anything is written; a structural draft
// waits for its checkpoint; a cosmetic one begins now.
import { expect, test, type Page } from '@playwright/test';
import { generateBlueprint } from '../../src/generator';
import { p1 } from '../fixtures/personas/p1';
import { personaEventLog } from '../engine/support/personaEventLog';
import { seedGeneratedSystem } from './support/seedDatabase';

test.use({ reducedMotion: 'reduce' });

const { blueprint } = generateBlueprint(p1.draft);
const engine = blueprint.domains.find((domain) => domain.role === 'engine')!;

async function openBlueprint(page: Page, now: string, days: number): Promise<void> {
  await page.clock.install({ time: new Date(now) });
  await seedGeneratedSystem(page, blueprint, personaEventLog(blueprint, p1.seed, { kind: 'steady', days }), now);
  await page.goto('/profile/settings/system/blueprint');
  await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('amend-panel')).toBeVisible();
}

test.describe('amending a generated System', () => {
  test('a rename is cosmetic: it begins now, and the timeline and the Codex show it', async ({ page }) => {
    test.setTimeout(120_000);
    await openBlueprint(page, '2026-09-12T10:00:00Z', 11);
    await page.getByTestId('amend-rename-domain').selectOption(engine.id);
    await page.getByTestId('amend-rename-to').fill('Outpost');
    await page.getByRole('button', { name: 'Stage rename' }).click();

    await expect(page.getByTestId('amend-class')).toHaveText('COSMETIC');
    await expect(page.getByTestId('amend-effect')).toHaveText('TAKES EFFECT NOW.');
    await page.getByTestId('amend-activate').click();

    await expect(page.getByTestId('version-badge')).toHaveText('v2 · since Day 12');
    await expect(page.getByTestId('revision-2')).toContainText(`${engine.designation} is now called OUTPOST.`);
    await expect(page.getByTestId('revision-2')).toContainText('cosmetic');
    await expect(page.getByTestId('codex-domains')).toContainText('OUTPOST');
    await expect(page.getByTestId('amend-draft')).toHaveCount(0);
  });

  test('a small change of target is operational: tomorrow; and nothing more can be staged until it has begun', async ({ page }) => {
    test.setTimeout(120_000);
    await openBlueprint(page, '2026-09-12T10:00:00Z', 11);
    const quest = blueprint.quests.find((candidate) => candidate.domainId === engine.id && candidate.type === 'core')!;
    await page.getByRole('button', { name: /Raise .* target/ }).first().click();
    await page.getByRole('button', { name: /Raise .* target/ }).first().click();
    await expect(page.getByTestId(`amend-target-value-${quest.id}`)).toHaveText('+10%');
    await expect(page.getByTestId('amend-class')).toHaveText('OPERATIONAL');
    await expect(page.getByTestId('amend-effect')).toHaveText('TAKES EFFECT TOMORROW.');
    await page.getByTestId('amend-activate').click();

    await expect(page.getByTestId('revision-2')).toContainText('from 2026-09-13');
    await expect(page.getByTestId('amend-scheduled')).toBeVisible();
    await expect(page.getByTestId('amend-panel')).toHaveCount(0);
  });

  test('a shift of weight is structural: it waits for the checkpoint, and the draft survives a reload', async ({ page }) => {
    test.setTimeout(120_000);
    await openBlueprint(page, '2026-09-12T10:00:00Z', 11);
    await page.getByRole('button', { name: 'Move 10 XP' }).click();
    await expect(page.getByTestId('amend-class')).toHaveText('STRUCTURAL');
    await expect(page.getByTestId('amend-effect')).toHaveText('TAKES EFFECT AFTER THE DAY 14 CHECKPOINT.');
    await expect(page.getByTestId('amend-activate')).toBeDisabled();
    await expect(page.getByTestId('amend-activate')).toContainText('Waits for the Day 14 checkpoint');

    await page.reload();
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId('amend-draft')).toBeVisible();
    await expect(page.getByTestId('amend-class')).toHaveText('STRUCTURAL');

    await page.getByTestId('amend-discard').click();
    await expect(page.getByTestId('amend-draft')).toHaveCount(0);
  });

  test('a draft the System would refuse says why and cannot be activated', async ({ page }) => {
    test.setTimeout(120_000);
    await openBlueprint(page, '2026-09-12T10:00:00Z', 11);
    const quest = blueprint.quests.find((candidate) => candidate.domainId === engine.id && candidate.type === 'core')!;
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: new RegExp(`Lower .* target`) }).first().click();
    await expect(page.getByTestId(`amend-target-value-${quest.id}`)).toHaveText('-25%');
    await expect(page.getByTestId('amend-issues')).toBeVisible();
    await expect(page.getByTestId('amend-activate')).toBeDisabled();
  });
});
