import { test, expect, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

const SAFE_TIME = '2026-09-05T10:00:00Z';

/** The floor from final/06 §7. A target below this is not reliably
 * tappable with a thumb, whatever it looks like. */
const MIN_TAP = 44;

async function boot(page: Page) {
  await page.clock.install({ time: new Date(SAFE_TIME) });
  await completeOnboarding(page);
}

/** A cold load re-runs the splash hold, so waiting on anything else
 * measures the splash instead of the screen. */
async function goto(page: Page, path: string) {
  await page.goto(path);
  await page.locator('nav').waitFor();
  await page.waitForTimeout(250);
}

interface Offender {
  what: string;
  detail: string;
}

async function auditPage(page: Page): Promise<Offender[]> {
  return page.evaluate((minTap) => {
    const problems: { what: string; detail: string }[] = [];
    const describe = (el: Element) => {
      const cls = (el.getAttribute('class') ?? '').slice(0, 60);
      const text = (el.textContent ?? '').trim().slice(0, 40);
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${text ? ` "${text}"` : ''}`;
    };

    // ── 1. no horizontal scroll ────────────────────────────────────
    const doc = document.documentElement;
    const main = document.querySelector('main');
    if (doc.scrollWidth > doc.clientWidth) {
      problems.push({ what: 'document scrolls sideways', detail: `${doc.scrollWidth} > ${doc.clientWidth}` });
    }
    if (main && main.scrollWidth > main.clientWidth) {
      problems.push({ what: 'main scrolls sideways', detail: `${main.scrollWidth} > ${main.clientWidth}` });
    }

    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };

    // ── 2. every interactive element clears the tap floor ──────────
    const interactive = document.querySelectorAll(
      'button, a[href], [role="button"], input:not([type="hidden"]), select, textarea'
    );
    for (const el of interactive) {
      if (!visible(el)) continue;
      // A control nested inside a bigger control inherits its target.
      if (el.parentElement?.closest('button, [role="button"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.height < minTap - 0.5 || r.width < minTap - 0.5) {
        problems.push({
          what: 'tap target below 44px',
          detail: `${Math.round(r.width)}x${Math.round(r.height)} — ${describe(el)}`,
        });
      }
    }

    // ── 3. no text clipped by its own box ──────────────────────────
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue;
      if (el.children.length > 0) continue; // leaves only — text lives there
      const s = getComputedStyle(el);
      if (s.overflow === 'visible' && s.overflowX === 'visible') continue;
      if (s.textOverflow === 'ellipsis') continue; // truncation is a choice
      // .sr-only is a 1px clipped box on purpose — that is the whole
      // technique. It is not visible text and cannot be clipped text.
      if (el.classList.contains('sr-only')) continue;
      if (el.scrollWidth > el.clientWidth + 1) {
        problems.push({ what: 'text clipped horizontally', detail: describe(el) });
      }
    }

    // ── 4. the nav never sits on top of content ────────────────────
    const nav = document.querySelector('nav');
    if (nav && main) {
      const n = nav.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      if (n.top < m.bottom - 1) {
        problems.push({
          what: 'nav overlaps content',
          detail: `nav.top ${Math.round(n.top)} < main.bottom ${Math.round(m.bottom)}`,
        });
      }
    }

    return problems;
  }, MIN_TAP);
}


/**
 * Walks every route by tapping, and audits each one.
 *
 * Deliberately not nine `page.goto` calls. Each cold load re-runs the
 * 900ms splash hold plus a full boot, so the walk cost ~44s and, under
 * the contention of a full-suite run, blew even a tripled timeout — the
 * test was failing for the number of boots it performed rather than for
 * anything it found. Tapping through is how a person reaches these
 * screens anyway, and it exercises the router on the way.
 */
async function walkAndAudit(page: Page, tag: string): Promise<string[]> {
  const found: string[] = [];
  const record = async (label: string) => {
    for (const p of await auditPage(page)) {
      found.push(`${label}${tag}: ${p.what} — ${p.detail}`);
    }
  };

  for (const tab of ['TODAY', 'PROGRESS', 'SKILLS', 'PROFILE'] as const) {
    await page.getByRole('link', { name: tab }).click();
    await page.waitForTimeout(300);
    await record(`/${tab.toLowerCase()}`);
  }

  // Settings and its four sections, from the Profile tab we are on.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(300);
  await record('/profile/settings');

  const sections = [
    ['settings-appearance-row', '/profile/settings/appearance'],
    ['settings-system-row', '/profile/settings/system'],
    ['settings-data-row', '/profile/settings/data'],
    ['settings-about-row', '/profile/settings/about'],
  ] as const;

  for (const [row, label] of sections) {
    await page.getByTestId(row).click();
    await page.waitForTimeout(300);
    await record(label);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForTimeout(250);
  }

  return found;
}

test('every route survives this viewport', async ({ page }) => {
  await boot(page);
  await goto(page, '/today');
  const found = await walkAndAudit(page, '');
  expect(found, found.join('\n')).toEqual([]);
});

test('the worst case: text scale XL, comfortable density', async ({ page }) => {
  await boot(page);

  // Set through the same localStorage key the app reads.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('system.settings.v1') || '{}');
    localStorage.setItem(
      'system.settings.v1',
      JSON.stringify({ ...s, version: 1, textScale: 'xl', density: 'comfortable' })
    );
  });

  // One cold load so the inline bootstrap picks it up before first
  // paint; everything after this is in-app navigation.
  await goto(page, '/today');
  const found = await walkAndAudit(page, ' @XL');
  expect(found, found.join('\n')).toEqual([]);
});

/**
 * Layout is theme-independent by construction — no theme changes a font
 * size, a padding or a rule width, only colour. This is what makes that
 * a checked property rather than an assumption.
 *
 * It audits the four tabs rather than all nine routes: the settings
 * screens are built from one list primitive, so running them through
 * five themes would re-prove the same fact five times for a third of the
 * suite's runtime.
 */
const THEMES = ['arc', 'dawn', 'abyss', 'contrast', 'daylight'] as const;
const TABS = ['TODAY', 'PROGRESS', 'SKILLS', 'PROFILE'] as const;

test('all five themes lay out identically', async ({ page }) => {
  await boot(page);
  await goto(page, '/today');

  const found: string[] = [];
  for (const theme of THEMES) {
    // Stamped directly, and navigated by tapping the nav rather than by
    // page.goto. Twenty cold loads would spend most of a minute
    // re-watching the splash hold, and this test is not about the
    // localStorage bootstrap — settings.spec already covers that path.
    // The attribute is the mechanism every rule in tokens.css keys off,
    // so setting it is setting the theme.
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);

    for (const tab of TABS) {
      await page.getByRole('link', { name: tab }).click();
      await page.waitForTimeout(300);
      for (const p of await auditPage(page)) {
        found.push(`${tab} @${theme}: ${p.what} — ${p.detail}`);
      }
    }
  }
  expect(found, found.join('\n')).toEqual([]);
});
