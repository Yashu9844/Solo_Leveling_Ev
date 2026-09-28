import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, reachStep6 } from './helpers';

async function arcRowCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const openReq = indexedDB.open('system-arc');
        openReq.onerror = () => reject(openReq.error);
        openReq.onsuccess = () => {
          const idb = openReq.result;
          const tx = idb.transaction('arc', 'readonly');
          const countReq = tx.objectStore('arc').count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => reject(countReq.error);
        };
      })
  );
}

test('fresh app boot with no arc lands on the Start screen', async ({ page }) => {
  // Deliberate behaviour change: a first-time user meets Start before
  // onboarding. Onboarding itself is still reachable directly, and still
  // redirects away once an arc exists (asserted below).
  await page.goto('/');
  await expect(page).toHaveURL(/\/start$/);
});

test('full six-step flow completes and lands on /today', async ({ page }) => {
  await completeOnboarding(page);
  await expect(page.getByRole('heading', { name: 'TODAY' })).toBeVisible();
});

test('arc persists across a reload', async ({ page }) => {
  await completeOnboarding(page);

  await page.reload();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: 'TODAY' })).toBeVisible();
});

test('/onboarding redirects to /today once an arc exists', async ({ page }) => {
  await completeOnboarding(page);

  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/today$/);
});

test('double-clicking "Initialise system" creates exactly one arc', async ({ page }) => {
  await reachStep6(page);

  // Dispatch two native clicks in the same tick — Playwright's own
  // .click() waits for the element to be enabled between calls, which
  // can't reproduce a real double-tap once the button self-disables.
  // This is also the more realistic race: both handlers can observe the
  // pre-update `isSubmitting` state before React re-renders, so the real
  // guarantee under test is initialiseArc()'s DB-level idempotency, not
  // just the UI debounce.
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Initialise system')
    ) as HTMLButtonElement | undefined;
    btn?.click();
    btn?.click();
  });

  await expect(page).toHaveURL(/\/today$/);
  expect(await arcRowCount(page)).toBe(1);
});

test('back-navigation through the steps preserves entered values', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin your journey' }).click();
  await page.getByPlaceholder('Your name').fill('Ada');
  await page.getByRole('button', { name: 'Begin' }).click(); // -> step 2
  await page.getByRole('button', { name: 'Next' }).click(); // -> step 3

  await page.getByRole('button', { name: 'Back' }).click(); // -> step 2
  await page.getByRole('button', { name: 'Back' }).click(); // -> step 1

  await expect(page.getByPlaceholder('Your name')).toHaveValue('Ada');
});
