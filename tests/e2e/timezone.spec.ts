// platform/05-ROADMAP.md loop 1.5 — a new arc takes the DEVICE's
// timezone, and the app then computes that zone's days, not Kolkata's.
import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

// 01:00Z on 5 Sep = 06:30 on the 5th in Kolkata · 21:00 on the 4th in New
// York · 02:00 on the 5th in London, which is before the 04:00 boundary,
// so still the 4th. Outside every zone's 03:00-04:00 closed window.
const INSTANT = '2026-09-05T01:00:00Z';

const CASES = [
  { zone: 'Asia/Kolkata', expectedDay: '2026-09-05' },
  { zone: 'America/New_York', expectedDay: '2026-09-04' },
  { zone: 'Europe/London', expectedDay: '2026-09-04' },
] as const;

async function readArcAndOpenedDays(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ timezone: string | undefined; opened: string[] }>((resolve, reject) => {
        const req = indexedDB.open('system-arc');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction(['arc', 'event'], 'readonly');
          const arcs = tx.objectStore('arc').getAll();
          const events = tx.objectStore('event').getAll();
          tx.oncomplete = () =>
            resolve({
              timezone: (arcs.result as { timezone: string }[])[0]?.timezone,
              opened: (events.result as { type: string; local_date: string }[])
                .filter((e) => e.type === 'APP_OPENED')
                .map((e) => e.local_date),
            });
        };
      })
  );
}

for (const { zone, expectedDay } of CASES) {
  test.describe(`device timezone ${zone}`, () => {
    test.use({ timezoneId: zone });

    test('onboarding shows the device zone', async ({ page }) => {
      await page.clock.install({ time: new Date(INSTANT) });
      await page.goto('/');
      await page.getByRole('button', { name: 'Begin your journey' }).click();
      await page.getByPlaceholder('Your name').fill('Ada');
      await page.getByRole('button', { name: 'Begin' }).click();
      await expect(page.getByTestId('arc-timezone')).toHaveText(`${zone} · day rolls at 04:00`);
    });

    test("the arc stores the zone and Today opens on that zone's day", async ({ page }) => {
      await page.clock.install({ time: new Date(INSTANT) });
      await completeOnboarding(page);
      await expect.poll(() => readArcAndOpenedDays(page)).toEqual({ timezone: zone, opened: [expectedDay] });
    });
  });
}
