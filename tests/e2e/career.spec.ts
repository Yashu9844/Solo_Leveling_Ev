import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding, waitForQuestInstanceState } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

async function withSafeClock(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
}

/** Fills and submits the application form. Does not assume the sheet
 * closes afterward — a passing application auto-closes ~900ms later; a
 * failing one stays open showing the gate-failure message. Callers that
 * need to log a SECOND application must explicitly wait for the sheet to
 * close first (see logPassingApplication), or the reopen can race the
 * still-open previous sheet and silently do nothing. */
async function fillAndSubmitApplication(page: Page, company: string, whyLine: string) {
  await page.getByTestId('quest-row-career-open').click();
  await page.getByRole('button', { name: /Despatch Ascension|Log application/ }).click();
  await page.getByLabel('Company').fill(company);
  await page.getByLabel('Role', { exact: true }).fill('Backend Engineer');
  await page.getByRole('button', { name: 'Backend' }).click();
  await page.getByRole('button', { name: 'Board' }).click();
  const newVersionInput = page.getByPlaceholder('New version label, e.g. v2 — AI-weighted');
  await newVersionInput.fill('v1');
  await page.getByRole('button', { name: '+ New' }).click();
  // handleCreateVersion is async (a write + a resumeVersionId state
  // update) — the input clearing on success is the signal it landed,
  // not just that the click's synchronous handler ran.
  await expect(newVersionInput).toHaveValue('');
  await page.getByLabel(/Why this role/).fill(whyLine);
  await page.getByRole('button', { name: /Despatch Ascension|Log application/ }).click();
}

async function logPassingApplication(page: Page, company: string, whyLine: string) {
  await fillAndSubmitApplication(page, company, whyLine);
  await expect(page.getByRole('heading', { name: /DESPATCH ASCENSION|LOG APPLICATION/ })).toHaveCount(0, { timeout: 8000 });
}

test('logging 3 quality applications auto-completes the CAREER quest', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  await logPassingApplication(page, 'Acme', 'Their agent infra work matches what I want to build next.');
  await expect(page.getByRole('button', { name: 'Complete CAREER' })).toBeVisible();

  await logPassingApplication(page, 'Beta Corp', 'They ship in public and the team writes real design docs.');
  await expect(page.getByRole('button', { name: 'Complete CAREER' })).toBeVisible();

  await logPassingApplication(page, 'Gamma Inc', 'Strong distributed-systems focus matching my recent DSA work.');
  await waitForQuestInstanceState(page, 'CAREER', '2026-09-05', 'complete');
  await expect(page.getByRole('button', { name: 'Undo CAREER' })).toBeVisible();
});

test('a duplicate why_line fails the quality gate and does not count toward completion', async ({ page }) => {
  await withSafeClock(page);
  await completeOnboarding(page);

  const line = 'Their agent infra work matches what I want to build next.';
  await logPassingApplication(page, 'Acme', line);
  await fillAndSubmitApplication(page, 'Beta Corp', line); // duplicate — fails the gate, sheet stays open

  await expect(page.getByText(/didn't pass/)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Complete CAREER' })).toBeVisible();
});
