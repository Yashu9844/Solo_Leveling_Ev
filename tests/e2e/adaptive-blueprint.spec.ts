// platform/05 loop 14.x: the Blueprint screen (Profile -> Settings -> System -> Blueprint) of a generated System with a revision history.
import { expect, test } from '@playwright/test';
import { activationEvent } from '../../src/blueprint/activation';
import { generateBlueprint } from '../../src/generator';
import { p1 } from '../fixtures/personas/p1';
import { personaEventLog } from '../engine/support/personaEventLog';
import { seedGeneratedSystem } from './support/seedDatabase';

test.use({ reducedMotion: 'reduce' });

test.describe('the Blueprint screen of a generated System', () => {
  test('shows the version in force, the timeline of revisions in plain words, and any version\'s Codex', async ({ page }) => {
    test.setTimeout(120_000);
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
    page.on('console', (message) => { if (message.type() === 'error') problems.push('console: ' + message.text()); });

    const { blueprint: v1 } = generateBlueprint(p1.draft);
    const events = personaEventLog(v1, p1.seed, { kind: 'steady', days: 14 });
    // Version 2: a cosmetic revision on day 13 - one engine domain is given another designation.
    const renamed = v1.domains.find((domain) => domain.role === 'engine')!;
    const v2 = structuredClone(v1);
    v2.version = 2;
    v2.changeClass = 'cosmetic';
    v2.activeFrom = '2026-09-13';
    v2.domains.find((domain) => domain.id === renamed.id)!.designation = 'OUTPOST';
    events.push(activationEvent(v2, { id: 'pl-v2', occurred_at: '2026-09-13T05:00:00Z', local_date: '2026-09-13' }));

    const now = '2026-09-15T10:00:00Z';
    await page.clock.install({ time: new Date(now) });
    await seedGeneratedSystem(page, v1, events, now);
    await page.goto('/profile/settings/system');
    await expect(page.getByTestId('splash')).toHaveCount(0, { timeout: 30_000 });

    await expect(page.getByTestId('blueprint-entry')).toContainText('v2 · since Day 13');
    await page.getByTestId('blueprint-entry').click();
    const screen = page.getByTestId('blueprint-screen');
    await expect(screen).toBeVisible();
    await expect(screen.getByTestId('version-badge')).toHaveText('v2 · since Day 13');

    // The timeline, newest first, each with what changed.
    await expect(screen.getByTestId('revision-2')).toContainText(`${renamed.designation} is now called OUTPOST.`);
    await expect(screen.getByTestId('revision-2')).toContainText('in force');
    await expect(screen.getByTestId('revision-1')).toContainText('genesis');
    await expect(screen.getByTestId('revision-1')).toContainText('The System was bound.');
    await expect(screen.getByTestId('revision-1')).toContainText('superseded');

    // The Codex shows the version in force, then any earlier one on tap.
    await expect(screen.getByTestId('codex-domains')).toContainText('OUTPOST');
    await screen.getByTestId('revision-1').click();
    await expect(screen.getByTestId('codex-domains')).toContainText(renamed.designation);
    await expect(screen.getByTestId('codex-domains')).not.toContainText('OUTPOST');
    await expect(screen.getByText('The System as of v1')).toBeVisible();
    for (const section of ['arc', 'domains', 'quests', 'checkpoints']) await expect(screen.getByTestId(`codex-${section}`)).toBeVisible();

    expect(problems).toEqual([]);
  });
});
