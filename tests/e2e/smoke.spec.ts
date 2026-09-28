import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('app loads and the four tabs are visible and navigable', async ({ page }) => {
  // Slice 1: the 4-tab shell is gated behind arc creation.
  await completeOnboarding(page);

  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();

  const tabs = ['TODAY', 'PROGRESS', 'SKILLS', 'PROFILE'];
  for (const label of tabs) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }

  for (const label of tabs) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
  }
});
