import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2];
const W = Number(process.argv[3] || 390);
const H = Number(process.argv[4] || 844);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });

const audit = async (tag) => {
  const problems = await page.evaluate(() => {
    const out = [];
    const d = document.documentElement;
    if (d.scrollWidth > d.clientWidth) out.push(`h-scroll ${d.scrollWidth}>${d.clientWidth}`);
    for (const el of document.querySelectorAll('button, input, textarea, a[href], [role="button"]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.parentElement?.closest('button, [role="button"]')) continue;
      if (r.height < 43.5 || r.width < 43.5) out.push(`tap ${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName} "${(el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,28)}"`);
    }
    return out;
  });
  if (problems.length) console.log(`  [${tag}] ${problems.join(' | ')}`);
};

await page.goto('http://localhost:4173/');
await page.getByRole('button', { name: 'Begin your journey' }).click();
await page.waitForURL(/onboarding/);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/01-identity.png` }); await audit('1');

await page.getByPlaceholder('Your name').fill('Yashavanth');
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/01-identity-typed.png` });

await page.getByRole('button', { name: 'Begin' }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/02-arc.png` }); await audit('2');

await page.getByRole('button', { name: 'Next' }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/03-rhythm.png` }); await audit('3');
await page.locator('.no-scrollbar').evaluate((e) => e.scrollTo(0, 9999));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/03-rhythm-bottom.png` });

await page.getByRole('button', { name: 'Next' }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/04-directive-empty.png` }); await audit('4');
await page.getByPlaceholder('This is the only thing the app judges you against.').fill('Ship a working agent and land an offer.');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/04-directive.png` });

await page.getByRole('button', { name: 'Next' }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/05-triggers-empty.png` }); await audit('5');
await page.getByTestId('career-intention-place').fill('my desk');
await page.getByTestId('career-intention-action').fill('open the job board before anything');
await page.getByTestId('dsa-intention-place').fill('my desk');
await page.getByTestId('dsa-intention-action').fill('open the editor');
await page.getByTestId('training-intention-place').fill('the gym');
await page.getByTestId('training-intention-action').fill('change & start');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/05-triggers.png` });
await page.locator('.no-scrollbar').evaluate((e) => e.scrollTo(0, 9999));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/05-triggers-bottom.png` });

await page.getByRole('button', { name: 'Next' }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/06-baseline.png` }); await audit('6');
await page.locator('.no-scrollbar').evaluate((e) => e.scrollTo(0, 9999));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/06-baseline-bottom.png` });
await page.locator('.no-scrollbar').evaluate((e) => e.scrollTo(0, 560));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/06-baseline-mid.png` });

await browser.close();
console.log('shots done ->', OUT);
