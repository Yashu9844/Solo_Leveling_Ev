import { test, expect } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('app loads with the network disabled after a warm-up install', async ({ page, context }) => {
  // Warm-up: registers the service worker, populates the precache, and
  // (Slice 1) creates the arc in IndexedDB — which is local and survives
  // going offline regardless of the service worker.
  await completeOnboarding(page);
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'TODAY' })).toBeVisible();
});
